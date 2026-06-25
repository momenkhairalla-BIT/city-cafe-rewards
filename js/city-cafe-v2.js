/**
 * City Café Rewards V2 — members, auth, offers, QR/barcode, menu images
 * Loaded after main index.html script; patches window globals.
 */
(function () {
  const AUTH_KEY = 'cityCafeAuthSession';

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
    const q = (code || '').trim();
    if (!q) return null;
    const up = q.toUpperCase();
    const data = loadData();
    return data.students.find(s =>
      (s.studentId && s.studentId.toUpperCase() === up) ||
      (s.memberCode && s.memberCode.toUpperCase() === up) ||
      (s.barcodeValue && s.barcodeValue.toUpperCase() === up) ||
      (s.qrValue && s.qrValue.toUpperCase() === up) ||
      (s.phone && s.phone === q)
    );
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
    const menu = loadData().menu;
    if (offer.discountType === 'double_points') {
      return { discount: 0, pointsMultiplier: Number(offer.discountValue) || 2, label: offer.offerName };
    }
    if (offer.discountType === 'percentage') {
      let base = subtotal;
      if (offer.appliesToCategory) {
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

  window.showLoginScreen = function () {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('entry-screen')?.classList.add('hidden');
    document.getElementById('role-switcher')?.classList.add('hidden');
    ['customer-app', 'staff-app', 'admin-app'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  };

  window.hideLoginScreen = function () {
    document.getElementById('login-screen')?.classList.add('hidden');
  };

  window.doLogin = async function (username, password) {
    if (apiEnabled) {
      try {
        const res = await apiPost('/api/auth/login', { username, password });
        const d = res.data;
        setAuthSession({
          username: d.user.username || username,
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
        toast(e.message || 'Login failed', 'error');
        return;
      }
    }
    const DEMO = {
      admin: { password: 'admin123', role: 'admin', fullName: 'Café Admin' },
      staff: { password: 'staff123', role: 'staff', fullName: 'Counter Staff' },
      CU2024001: { password: 'demo123', role: 'customer', fullName: 'Ahmad Faiz', memberCode: 'CU-M-2024001' },
      general001: { password: 'demo123', role: 'customer', fullName: 'Ali Rahman', memberCode: 'GC-M-001' },
    };
    const acc = DEMO[username.trim()];
    if (!acc || acc.password !== password) { toast('Invalid credentials', 'error'); return; }
    setAuthSession({ username: username.trim(), role: acc.role, fullName: acc.fullName, memberCode: acc.memberCode });
    toast('Welcome, ' + acc.fullName, 'success');
    routeAfterLogin(acc.role, acc.memberCode);
  };

  window.routeAfterLogin = function (role, memberCode) {
    hideLoginScreen();
    if (role === 'admin') showView('admin');
    else if (role === 'staff') showView('staff');
    else if (role === 'customer') {
      const m = findMemberLocal(memberCode || 'CU2024001') || findMemberLocal('CU2024001');
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

  window.showRegisterModal = function (type) {
    const isStudent = type === 'city_student';
    showModal(isStudent ? 'Register City University Student' : 'Register General Customer', `
      <div class="input-group"><label>${isStudent ? 'Student ID' : 'Full Name'} *</label>
        <input id="reg-primary" placeholder="${isStudent ? 'CU2024006' : 'Full name'}"></div>
      ${isStudent ? `<div class="input-group"><label>Name *</label><input id="reg-name"></div>
        <div class="input-group"><label>Programme *</label><input id="reg-programme"></div>` : ''}
      <div class="input-group"><label>${isStudent ? 'Email' : 'Phone'} *</label>
        <input id="reg-contact" placeholder="${isStudent ? 'email@student.city.edu.my' : '60123456789'}"></div>
      <div class="input-group"><label>${isStudent ? 'Phone (optional)' : 'Email (optional)'}</label>
        <input id="reg-secondary"></div>
      <div class="input-group"><label>Password (min 6 characters) *</label>
        <input id="reg-password" type="password" placeholder="Choose a password"></div>
    `, `
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="submitRegister('${type}')">Register</button>
    `);
  };

  window.submitRegister = async function (customerType) {
    const primary = document.getElementById('reg-primary')?.value?.trim();
    const name = customerType === 'city_student'
      ? document.getElementById('reg-name')?.value?.trim()
      : primary;
    const programme = document.getElementById('reg-programme')?.value?.trim();
    const contact = document.getElementById('reg-contact')?.value?.trim();
    const secondary = document.getElementById('reg-secondary')?.value?.trim();
    const password = document.getElementById('reg-password')?.value || 'demo123';
    if (!name) { toast('Name is required', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (customerType === 'city_student' && !primary) { toast('Student ID required', 'error'); return; }
    if (customerType === 'general_customer' && !contact) { toast('Phone required', 'error'); return; }

    const body = customerType === 'city_student'
      ? { customerType, studentId: primary.toUpperCase(), name, programme, email: contact, phone: secondary, password }
      : { customerType, name, phone: contact, email: secondary || null, password };

    if (apiEnabled) {
      try {
        const res = await apiPost('/api/auth/register', body);
        closeModal();
        toast('Registration successful!', 'success');
        const mc = res.data.member?.memberCode || res.data.member?.member_code;
        setAuthSession({
          username: res.data.username || res.data.user?.username,
          role: 'customer',
          fullName: name,
          memberCode: mc,
          token: res.data.token,
          userId: res.data.user?.id,
        });
        if (typeof syncFromApi === 'function') await syncFromApi();
        const ui = loadUiState();
        ui.selectedCustomerId = res.data.member?.studentId || res.data.member?.student_id || mc;
        saveUiState(ui);
        hideLoginScreen();
        showView('customer');
        return;
      } catch (e) {
        toast(e.message || 'Registration failed', 'error');
        return;
      }
    }

    const data = loadData();
    if (customerType === 'city_student' && data.students.some(s => s.studentId === primary.toUpperCase())) {
      toast('Student ID already registered', 'error'); return;
    }
    if (data.students.some(s => s.phone && s.phone === contact)) {
      toast('Phone already registered', 'error'); return;
    }
    const member = createMember({
      customerType,
      studentId: customerType === 'city_student' ? primary.toUpperCase() : null,
      name,
      programme: programme || null,
      email: customerType === 'city_student' ? contact : (secondary || null),
      phone: customerType === 'general_customer' ? contact : (secondary || null),
    });
    data.students.push(member);
    saveData(data);
    closeModal();
    toast('Registration successful!', 'success');
    setAuthSession({ username: member.memberCode, role: 'customer', fullName: name, memberCode: member.memberCode });
    const ui = loadUiState();
    ui.selectedCustomerId = member.studentId || member.memberCode;
    saveUiState(ui);
    hideLoginScreen();
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

  const origStaffScan = window.staffScanStudent;
  window.staffScanStudent = async function () {
    const input = document.getElementById('staff-id-input');
    const code = (input ? input.value : '').trim();
    if (!code) { toast('Enter or scan a member code', 'error'); return; }
    if (apiEnabled) {
      try {
        const res = await apiFetch('/api/scan/' + encodeURIComponent(code));
        const m = res.data;
        const id = m.studentId || m.student_id || m.memberCode || m.member_code;
        saveUiState({ ...loadUiState(), staffScannedId: id });
        toast('Member loaded: ' + (m.name || m.fullName), 'success');
        await syncFromApi();
        renderStaff();
        return;
      } catch (e) {
        toast(e.message || 'Member not found', 'error');
        return;
      }
    }
    const member = findMemberLocal(code);
    if (!member) { toast('Member not found', 'error'); return; }
    const data = loadData();
    data.staffScannedId = member.studentId || member.memberCode;
    saveUiState({ ...loadUiState(), staffScannedId: data.staffScannedId });
    saveData(data);
    toast('Member loaded: ' + member.name, 'success');
    renderStaff();
  };

  window.posSelectedOfferId = null;

  const origPosCheckout = window.posCheckout;

  window.posCheckout = async function () {
    const s = getScannedStudent();
    if (!s) { toast('Scan member first', 'error'); return; }
    window._posOfferUsed = null;
    window._posPointsMultiplier = 1;
    const data = loadData();
    const offer = (data.offers || []).find(o => (o.offerId || o.id) === window.posSelectedOfferId);
    const subtotal = posCart.reduce((sum, i) => sum + i.price * i.qty, 0);
    if (offer) {
      if (offer.customerTypeEligibility === 'city_student' && s.customerType === 'general_customer') {
        toast('This offer is only for City University students.', 'error');
        return;
      }
      const calc = calcOfferDiscount(offer, posCart, subtotal);
      posDiscount = Math.max(posDiscount || 0, calc.discount);
      window._posOfferUsed = calc.label || offer.offerName;
      window._posPointsMultiplier = calc.pointsMultiplier;
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
