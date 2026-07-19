import { version as reactVersion } from 'react';
import MappingModal from './MappingModal.jsx';
import MockModal from './MockModal.jsx';
import ExportModal from './ExportModal.jsx';
import AboutModal from './AboutModal.jsx';
import { useI18nT } from '../../js/i18nContext.js';

export default function AppModals({
  modal,
  mappings,
  setMappings,
  mocks,
  setMocks,
  mockModalMappings,
  settings,
  appVersion,
  electronVersion,
  nodeVersion,
  bootstrapVersion,
  onClose,
  setModal,
  showToast,
}) {
  const t = useI18nT();
  if (!modal) return null;

  switch (modal.type) {
    case 'addMapping':
      return (
        <MappingModal
          mappings={mappings}
          httpsEnabled={!!settings.httpsEnabled}
          onClose={onClose}
          onSubmit={async (data) => {
            const updated = await window.electronAPI.mappings.add(data);
            setMappings(updated);
            setModal(null);
            showToast(t('flash.mapping.added', { domain: data.domain, host: data.host, port: data.port }), 'success');
          }}
        />
      );

    case 'editMapping':
      return (
        <MappingModal
          mapping={modal.mapping}
          mappings={mappings}
          httpsEnabled={!!settings.httpsEnabled}
          onClose={onClose}
          onSubmit={async (data) => {
            const updated = await window.electronAPI.mappings.update(modal.mapping.id, data);
            setMappings(updated);
            setModal(null);
            showToast(t('flash.mapping.updated', { domain: data.domain, host: data.host, port: data.port }), 'success');
          }}
        />
      );

    case 'exportMappings':
      return (
        <ExportModal
          items={mappings.map((m) => ({ id: m.id, label: m.domain }))}
          i18nPrefix="mappings.modals.export"
          onClose={onClose}
          onSubmit={async (ids) => {
            const result = await window.electronAPI.mappings.export(ids);
            if (result.canceled) return;
            if (result.success) {
              setModal(null);
              showToast(t('flash.export.success', { count: result.count, path: result.path }), 'success');
            } else {
              showToast(t('flash.export.error', { error: result.error }), 'error');
            }
          }}
        />
      );

    case 'addMock':
      return (
        <MockModal
          mappings={mockModalMappings()}
          onClose={onClose}
          onSubmit={async (data) => {
            const result = await window.electronAPI.mocks.add(data);
            if (result.success) {
              setMocks(result.mocks);
              setModal(null);
              showToast(t('flash.mock.added'), 'success');
            }
            return result;
          }}
          showToast={showToast}
        />
      );

    case 'editMock':
      return (
        <MockModal
          mock={modal.mock}
          mappings={mockModalMappings(modal.mock)}
          onClose={onClose}
          onSubmit={async (data) => {
            const result = await window.electronAPI.mocks.update(modal.mock.id, data);
            if (result.success) {
              setMocks(result.mocks);
              setModal(null);
              showToast(t('flash.mock.updated'), 'success');
            }
            return result;
          }}
          showToast={showToast}
        />
      );

    case 'exportMocks':
      return (
        <ExportModal
          items={mocks.map((m) => ({
            id: m.id,
            label: `${m.method === '*' ? t('mocks.modals.manage.form.method.any') : m.method} ${m.pathPattern}`,
          }))}
          i18nPrefix="mocks.modals.export"
          onClose={onClose}
          onSubmit={async (ids) => {
            const result = await window.electronAPI.mocks.export(ids);
            if (result.canceled) return;
            if (result.success) {
              setModal(null);
              showToast(t('flash.mocksExport.success', { count: result.count, path: result.path }), 'success');
            } else {
              showToast(t('flash.mocksExport.error', { error: result.error }), 'error');
            }
          }}
        />
      );

    case 'convertToMock':
      return (
        <MockModal
          initialValues={modal.initialValues}
          mappings={mockModalMappings({ mappingId: modal.mappingId })}
          onClose={onClose}
          onSubmit={async (data) => {
            const result = await window.electronAPI.mocks.add(data);
            if (result.success) {
              setMocks(result.mocks);
              setModal(null);
              showToast(t('flash.mock.added'), 'success');
            }
            return result;
          }}
          showToast={showToast}
        />
      );

    case 'about':
      return (
        <AboutModal
          version={appVersion}
          electronVersion={electronVersion}
          nodeVersion={nodeVersion}
          reactVersion={reactVersion}
          bootstrapVersion={bootstrapVersion}
          onClose={onClose}
        />
      );

    default:
      return null;
  }
}
