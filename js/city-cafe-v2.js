/**
 * City Café Rewards V2 — auth, registration, members, offers, QR/barcode
 * Loaded after main index.html script; patches window globals.
 */
(function () {
  const AUTH_KEY = 'cityCafeAuthSession';
  let registerType = null;

  window.getAuthSession = function () {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
  };
  window.setAuthSession = function (s) {
    if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    else localStorage.removeItem(AUTH_KEY);
  };

  window.memberTypeLabel = function (t) {
    return t === 'city_student' ? 'City University Student' : 'General Customer';
  };
  window.memberTypeBadge = function (m) {
    const t = m.customerType || (m.studentId ? 'city_student' : 'general_customer');
    const cls = t === 'city_student' ? 'badge-student' : 'badge-general';
    return `<span class="member-type-badge ${cls}">${memberTypeLabel(t)}</span>`;
  };

  window.findMemberLocal = function (code) {
    return typeof findMemberByQuery === 'function' ? findMemberByQuery(code) : null;
  };

  function friendlyAuthError(err) {
    const msg = (err?.message || String(err || '')).toLowerCase();
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
      return 'Unable to connect to server. Please try again.';
    }
    if (msg.includes('database unavailable') || msg.includes('503')) {
      return 'Service temporarily unavailable. Please try again in a moment.';
    }
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return err.message || 'This account is already registered.';
    }
    if (msg.includes('password') && msg.includes('match')) {
      return 'Passwords do not match.';
    }
    if (msg.includes('invalid credentials') || msg.includes('401')) {
      return 'Invalid username or password. Please try again.';
    }
    if (msg.includes('required')) {
      return err.message || 'Please fill in all required fields.';
    }
    return 'Unable to complete request. Please check your details and try again.';
  }

  function setLoginError(message) {
    const el = document.getElementById('login-error');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.add('visible');
    } else {
      el.textContent = '';
      el.classList.remove('visible');
    }
  }

  function setRegisterError(message) {
    const el = document.getElementById('register-error');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.add('visible');
    } else {
      el.textContent = '';
      el.classList.remove('visible');
    }
  }

  window.showLoginScreen = function () {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('register-screen')?.classList.add('hidden');
    document.getElementById('entry-screen')?.classList.add('hidden');
    document.getElementById('role-switcher')?.classList.add('hidden');
    ['customer-app', 'staff-app', 'admin-app'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    setLoginError('');
  };

  window.hideLoginScreen = function () {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('register-screen')?.classList.add('hidden');
  };

  window.showRegisterTypeScreen = function () {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('register-screen')?.classList.remove('hidden');
    document.getElementById('register-type-step')?.classList.remove('hidden');
    document.getElementById('register-form-step')?.classList.add('hidden');
    setRegisterError('');
    registerType = null;
  };

  window.showRegisterForm = function (type) {
    registerType = type;
    const isStudent = type === 'city_student';
    document.getElementById('register-type-step')?.classList.add('hidden');
    document.getElementById('register-form-step')?.classList.remove('hidden');
    document.getElementById('register-form-title').textContent = isStudent
      ? 'Register City University Student'
      : 'Register General Customer';
    document.getElementById('register-form-subtitle').textContent = isStudent
      ? 'Student ID and email are required. Special offers apply after registration.'
      : 'Phone number is required. Earn points and stamps on every purchase.';
    setRegisterError('');
    document.getElementById('register-form-fields').innerHTML = isStudent ? `
      <div class="input-group"><label>Student ID *</label>
        <input id="reg-student-id" placeholder="CU2024999" autocomplete="off"></div>
      <div class="input-group"><label>Full Name *</label>
        <input id="reg-name" placeholder="Full name"></div>
      <div class="input-group"><label>Programme *</label>
        <input id="reg-programme" placeholder="Bachelor of IT"></div>
      <div class="input-group"><label>Email *</label>
        <input id="reg-email" type="email" placeholder="name@student.city.edu.my"></div>
      <div class="input-group"><label>Phone (optional)</label>
        <input id="reg-phone" placeholder="60123456789"></div>
      <div class="input-group"><label>Password *</label>
        <input id="reg-password" type="password" placeholder="Min 6 characters" autocomplete="new-password"></div>
      <div class="input-group"><label>Confirm Password *</label>
        <input id="reg-confirm" type="password" placeholder="Re-enter password" autocomplete="new-password"></div>
    ` : `
      <div class="input-group"><label>Full Name *</label>
        <input id="reg-name" placeholder="Full name"></div>
      <div class="input-group"><label>Phone Number *</label>
        <input id="reg-phone" placeholder="60123456789"></div>
      <div class="input-group"><label>Email (optional)</label>
        <input id="reg-email" type="email" placeholder="email@example.com"></div>
      <div class="input-group"><label>Password *</label>
        <input id="reg-password" type="password" placeholder="Min 6 characters" autocomplete="new-password"></div>
      <div class="input-group"><label>Confirm Password *</label>
        <input id="reg-confirm" type="password" placeholder="Re-enter password" autocomplete="new-password"></div>
    `;
    const btn = document.getElementById('register-submit-btn');
    if (btn) btn.onclick = () => submitRegister(type);
  };

  /** Public registration — type selection screen */
  window.showRegisterModal = function (type) {
    const session = typeof getAuthSession === 'function' ? getAuthSession() : null;
    if (session?.role === 'admin') {
      showAdminAddMemberModal(type);
      return;
    }
    showRegisterTypeScreen();
    if (type) showRegisterForm(type);
  };

  window.showAdminAddMemberModal = function (type) {
    const isStudent = type === 'city_student';
    showModal(isStudent ? 'Add City University Student' : 'Add General Customer', `
      ${isStudent ? `
        <div class="input-group"><label>Student ID *</label><input id="adm-student-id" placeholder="CU2024999"></div>
        <div class="input-group"><label>Full Name *</label><input id="adm-name"></div>
        <div class="input-group"><label>Programme</label><input id="adm-programme"></div>
        <div class="input-group"><label>Email</label><input id="adm-email" type="email"></div>
        <div class="input-group"><label>Phone</label><input id="adm-phone"></div>
      ` : `
        <div class="input-group"><label>Full Name *</label><input id="adm-name"></div>
        <div class="input-group"><label>Phone *</label><input id="adm-phone" placeholder="60123456789"></div>
        <div class="input-group"><label>Email</label><input id="adm-email" type="email"></div>
      `}`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary btn-sm" onclick="submitAdminAddMember('${type}')">Add Member</button>`
    );
  };

  window.submitAdminAddMember = async function (type) {
    const name = document.getElementById('adm-name')?.value?.trim();
    const phone = document.getElementById('adm-phone')?.value?.trim();
    const email = document.getElementById('adm-email')?.value?.trim();
    if (!name) { toast('Name is required', 'error'); return; }
    if (type === 'general_customer' && !phone) { toast('Phone is required', 'error'); return; }
    const payload = {
      customerType: type,
      name,
      phone: phone || null,
      email: email || null,
    };
    if (type === 'city_student') {
      const studentId = document.getElementById('adm-student-id')?.value?.trim();
      if (!studentId) { toast('Student ID is required', 'error'); return; }
      payload.studentId = studentId.toUpperCase();
      payload.programme = document.getElementById('adm-programme')?.value?.trim() || '';
    }
    if (typeof isApiAvailable === 'function' ? isApiAvailable() : apiEnabled) {
      try {
        await apiPost('/api/members', payload);
        await syncFromApi();
        closeModal();
        toast('Member added', 'success');
        renderAdmin();
        return;
      } catch (e) {
        toast(friendlyAuthError(e), 'error');
        return;
      }
    }
    const data = loadData();
    if (type === 'city_student' && data.students.some(s => s.studentId === payload.studentId)) {
      toast('Student ID already exists', 'error'); return;
    }
    if (phone && data.students.some(s => s.phone === phone)) {
      toast('Phone already registered', 'error'); return;
    }
    data.students.push(createMember({
      customerType: type,
      studentId: payload.studentId || null,
      name,
      programme: payload.programme,
      email: email || null,
      phone: phone || null,
    }));
    saveData(data);
    closeModal();
    toast('Member added', 'success');
    renderAdmin();
  };

  window.getEligibleOffers = function (member) {
    const data = loadData();
    const offers = data.offers || [];
    const type = member?.customerType || 'general_customer';
    const today = new Date().toISOString().slice(0, 10);
    return offers.filter(o => {
      if (!o.isActive) return false;
      if (o.startDate && o.startDate > today) return false;
      if (o.endDate && o.endDate < today) return false;
      if (o.customerTypeEligibility === 'all') return true;
      if (o.customerTypeEligibility === 'city_student' && type === 'city_student') return true;
      if (o.customerTypeEligibility === 'general_customer' && type === 'general_customer') return true;
      return false;
    });
  };

  window.calcOfferDiscount = function (offer, cart, subtotal) {
    if (!offer) return { discount: 0, pointsMultiplier: 1, label: '' };
    const slug = offer.slug || offer.offerId || '';
    const name = offer.offerName || '';
    if (offer.discountType === 'double_points') {
      return { discount: 0, pointsMultiplier: Number(offer.discountValue) || 2, label: offer.offerName };
    }
    if (offer.discountType === 'percentage') {
      let base = subtotal;
      if (slug === 'student-drink-10' || name.includes('10% Student Drink')) {
        base = cart.filter(c => c.category === 'Coffee' || c.category === 'Iced Drinks')
          .reduce((s, i) => s + i.price * i.qty, 0);
      } else if (offer.appliesToCategory) {
        base = cart.filter(c => c.category === offer.appliesToCategory).reduce((s, i) => s + i.price * i.qty, 0);
      }
      const d = base * (Number(offer.discountValue) / 100);
      return { discount: d, pointsMultiplier: 1, label: offer.offerName };
    }
    if (offer.discountType === 'fixed_amount') {
      return { discount: Math.min(Number(offer.discountValue), subtotal), pointsMultiplier: 1, label: offer.offerName };
    }
    if (offer.discountType === 'special_price') {
      const hasCoffee = cart.some(c => c.category === 'Coffee' || c.category === 'Iced Drinks');
      const hasCroissant = cart.some(c => (c.name || '').toLowerCase().includes('croissant'));
      if (hasCoffee && hasCroissant) {
        const normal = cart.reduce((s, i) => s + i.price * i.qty, 0);
        const special = Number(offer.discountValue) || 12;
        return { discount: Math.max(0, normal - special), pointsMultiplier: 1, label: offer.offerName };
      }
    }
    return { discount: 0, pointsMultiplier: 1, label: '' };
  };

  window.applySelectedPosOffer = function () {
    const s = typeof getScannedStudent === 'function' ? getScannedStudent() : null;
    window._posOfferUsed = null;
    window._posPointsMultiplier = 1;
    window._posOfferId = null;
    posDiscount = 0;
    if (!window.posSelectedOfferId || !s || !posCart.length) return;
    const data = loadData();
    const offer = (data.offers || []).find(o =>
      (o.offerId || o.id) === window.posSelectedOfferId || o.slug === window.posSelectedOfferId
    );
    if (!offer) return;
    if (offer.customerTypeEligibility === 'city_student' && s.customerType === 'general_customer') {
      toast('This offer is only available for City University students.', 'error');
      window.posSelectedOfferId = null;
      return;
    }
    const subtotal = posCart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const calc = calcOfferDiscount(offer, posCart, subtotal);
    posDiscount = calc.discount;
    window._posOfferUsed = calc.label || offer.offerName;
    window._posPointsMultiplier = calc.pointsMultiplier;
    window._posOfferId = offer.offerId || offer.id;
  };

  window.renderBarcode = function (code) {
    let hash = 0;
    for (let i = 0; i < code.length; i++) hash = ((hash << 5) - hash) + code.charCodeAt(i);
    let bars = '';
    for (let i = 0; i < 40; i++) {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      const w = (hash % 4) + 1;
      bars += `<div class="barcode-bar" style="width:${w}px"></div>`;
    }
    return `<div class="barcode-visual">${bars}</div><div class="barcode-code">${code}</div>`;
  };

  window.doLogin = async function (username, password) {
    setLoginError('');
    if (!username?.trim() || !password) {
      setLoginError('Please enter your username and password.');
      return;
    }
    if (typeof isApiAvailable === 'function' ? isApiAvailable() : apiEnabled) {
      try {
        const res = await apiPost('/api/auth/login', { username: username.trim(), password });
        const d = res.data;
        setAuthSession({
          username: d.user.username || username.trim(),
          role: d.user.role,
          fullName: d.user.fullName,
          memberCode: d.memberCode,
          token: d.token,
          userId: d.user.id,
        });
        if (typeof syncFromApi === 'function') await syncFromApi();
        toast('Welcome, ' + d.user.fullName, 'success');
        routeAfterLogin(d.user.role, d.memberCode);
        return;
      } catch (e) {
        setLoginError(friendlyAuthError(e));
        return;
      }
    }
    const key = username.trim();
    const DEMO = {
      admin: { password: 'admin123', role: 'admin', fullName: 'Café Admin' },
      staff: { password: 'staff123', role: 'staff', fullName: 'Counter Staff' },
      CU2024001: { password: 'demo123', role: 'customer', fullName: 'Ahmad Faiz', memberCode: 'CU-M-2024001' },
      general001: { password: 'demo123', role: 'customer', fullName: 'Ali Rahman', memberCode: 'GC-M-001' },
    };
    let acc = DEMO[key] || DEMO[key.toUpperCase()];
    if (!acc) {
      const member = findMemberLocal(key);
      if (member) {
        acc = DEMO[member.studentId] || DEMO[member.memberCode] || (member.phone === key ? DEMO.general001 : null);
      }
    }
    if (!acc || acc.password !== password) {
      setLoginError('Invalid username or password. Please try again.');
      return;
    }
    setAuthSession({ username: key, role: acc.role, fullName: acc.fullName, memberCode: acc.memberCode });
    toast('Welcome, ' + acc.fullName, 'success');
    routeAfterLogin(acc.role, acc.memberCode);
  };

  window.routeAfterLogin = function (role, memberCode) {
    hideLoginScreen();
    if (role === 'admin') showView('admin');
    else if (role === 'staff') showView('staff');
    else if (role === 'customer') {
      const m = findMemberLocal(memberCode) || findMemberLocal('CU2024001');
      const ui = loadUiState();
      ui.selectedCustomerId = m?.studentId || m?.memberCode || memberCode;
      saveUiState(ui);
      showView('customer');
    }
  };

  window.demoLogin = function (user, pass) {
    const u = document.getElementById('login-username');
    const p = document.getElementById('login-password');
    if (u) u.value = user;
    if (p) p.value = pass;
    doLogin(user, pass);
  };

  window.submitLogin = function () {
    const u = document.getElementById('login-username')?.value;
    const p = document.getElementById('login-password')?.value;
    doLogin(u, p);
  };

  window.submitRegister = async function (customerType) {
    setRegisterError('');
    const password = document.getElementById('reg-password')?.value || '';
    const confirm = document.getElementById('reg-confirm')?.value || '';
    const name = document.getElementById('reg-name')?.value?.trim();

    if (!name) { setRegisterError('Full name is required.'); return; }
    if (password.length < 6) { setRegisterError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setRegisterError('Passwords do not match.'); return; }

    let body;
    if (customerType === 'city_student') {
      const studentId = document.getElementById('reg-student-id')?.value?.trim();
      const programme = document.getElementById('reg-programme')?.value?.trim();
      const email = document.getElementById('reg-email')?.value?.trim();
      const phone = document.getElementById('reg-phone')?.value?.trim();
      if (!studentId) { setRegisterError('Student ID is required.'); return; }
      if (!programme) { setRegisterError('Programme is required.'); return; }
      if (!email) { setRegisterError('Email is required.'); return; }
      body = {
        registrationType: 'city_student',
        customerType: 'city_student',
        studentId: studentId.toUpperCase(),
        name,
        programme,
        email,
        phone: phone || null,
        password,
        confirmPassword: confirm,
      };
    } else {
      const phone = document.getElementById('reg-phone')?.value?.trim();
      const email = document.getElementById('reg-email')?.value?.trim();
      if (!phone) { setRegisterError('Phone number is required.'); return; }
      body = {
        registrationType: 'general_customer',
        customerType: 'general_customer',
        name,
        phone,
        email: email || null,
        password,
        confirmPassword: confirm,
      };
    }

    if (typeof isApiAvailable === 'function' ? isApiAvailable() : apiEnabled) {
      try {
        const res = await apiPost('/api/auth/register', body);
        const d = res.data;
        const member = d.member || {};
        const mc = member.memberCode || member.member_code || d.memberCode;
        setAuthSession({
          username: d.user?.username || body.phone || body.studentId,
          role: 'customer',
          fullName: name,
          memberCode: mc,
          token: d.token,
          userId: d.user?.id,
        });
        if (typeof syncFromApi === 'function') await syncFromApi();
        hideLoginScreen();
        const ui = loadUiState();
        ui.selectedCustomerId = member.studentId || member.student_id || mc;
        saveUiState(ui);
        const isStudent = customerType === 'city_student';
        toast(
          isStudent
            ? 'Student registration successful. Special offers are now available.'
            : 'Registration successful. You can now earn points and stamps.',
          'success'
        );
        showView('customer');
        return;
      } catch (e) {
        setRegisterError(friendlyAuthError(e));
        return;
      }
    }

    const data = loadData();
    if (customerType === 'city_student') {
      const sid = body.studentId;
      if (data.students.some(s => s.studentId === sid)) {
        setRegisterError('Student ID already registered.'); return;
      }
      if (body.email && data.students.some(s => s.email && s.email.toLowerCase() === body.email.toLowerCase())) {
        setRegisterError('Email already registered.'); return;
      }
    }
    if (body.phone && data.students.some(s => s.phone === body.phone)) {
      setRegisterError('Phone number already registered.'); return;
    }
    const member = createMember({
      customerType,
      studentId: customerType === 'city_student' ? body.studentId : null,
      name,
      programme: body.programme || null,
      email: customerType === 'city_student' ? body.email : (body.email || null),
      phone: customerType === 'general_customer' ? body.phone : (body.phone || null),
    });
    data.students.push(member);
    saveData(data);
    setAuthSession({
      username: customerType === 'city_student' ? member.studentId : member.phone,
      role: 'customer',
      fullName: name,
      memberCode: member.memberCode,
    });
    const ui = loadUiState();
    ui.selectedCustomerId = member.studentId || member.memberCode;
    saveUiState(ui);
    hideLoginScreen();
    toast(
      customerType === 'city_student'
        ? 'Student registration successful. Special offers are now available.'
        : 'Registration successful. You can now earn points and stamps.',
      'success'
    );
    showView('customer');
  };

  const origShowView = showView;
  window.showView = function (role) {
    if (role !== null) {
      const session = getAuthSession();
      if (!session) { showLoginScreen(); return; }
      if (role === 'admin' && session.role !== 'admin') { toast('Admin access required', 'error'); return; }
      if (role === 'staff' && !['staff', 'admin'].includes(session.role)) { toast('Staff access required', 'error'); return; }
      if (role === 'customer' && session.role !== 'customer' && session.role !== 'admin') {
        toast('Customer login required', 'error'); return;
      }
    } else {
      setAuthSession(null);
      showLoginScreen();
      return;
    }
    hideLoginScreen();
    origShowView(role);
  };

  window.posSelectedOfferId = null;

  const origPosCheckout = window.posCheckout;

  window.posCheckout = async function () {
    if (typeof applySelectedPosOffer === 'function') applySelectedPosOffer();
    const s = getScannedStudent();
    if (!s) { toast('Scan member first', 'error'); return; }
    const data = loadData();
    const offer = (data.offers || []).find(o =>
      (o.offerId || o.id) === window.posSelectedOfferId || o.slug === window.posSelectedOfferId
    );
    if (offer && offer.customerTypeEligibility === 'city_student' && s.customerType === 'general_customer') {
      toast('This offer is only available for City University students.', 'error');
      return;
    }
    return origPosCheckout();
  };

  window.logoutUser = function () {
    setAuthSession(null);
    showLoginScreen();
  };

  document.getElementById('login-form')?.addEventListener('submit', e => { e.preventDefault(); submitLogin(); });
  document.getElementById('btn-logout')?.addEventListener('click', logoutUser);
  if (!getAuthSession()) showLoginScreen();
  else hideLoginScreen();
})();
