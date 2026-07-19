import { isUiPreviewMode, UI_PREVIEW_LABEL } from '../../preview/uiPreviewMode';

export function UiPreviewBanner() {
  if (!isUiPreviewMode()) return null;
  return (
    <div className="ui-preview-banner" role="status">
      {UI_PREVIEW_LABEL}
    </div>
  );
}
