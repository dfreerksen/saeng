import { useRef } from 'react';
import { useI18nT } from '../js/i18nContext.js';

const CONDITION_TYPES = ['header', 'query', 'body'];
const CONDITION_OPERATORS = ['equals', 'contains', 'regex', 'exists'];

let rowKeyCounter = 0;

export default function ConditionListEditor({ conditions, onChange }) {
  const t = useI18nT();
  // Stable per-row keys: row objects are recreated on every edit, so identity
  // can't be used, and index keys break focus when a middle row is removed.
  const rowKeys = useRef([]).current;
  while (rowKeys.length < conditions.length) rowKeys.push(`cond-${++rowKeyCounter}`);
  if (rowKeys.length > conditions.length) rowKeys.length = conditions.length;

  function updateRow(index, field, value) {
    onChange(conditions.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addRow() {
    onChange([...conditions, { type: 'header', key: '', operator: 'equals', value: '' }]);
  }

  function removeRow(index) {
    rowKeys.splice(index, 1);
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="form-group">
      <label className="form-label">
        <span>{t('mocks.modals.manage.form.conditions.label')}</span>
        <span className="form-label-hint">{t('mappings.modals.manage.form.optional')}</span>
      </label>
      {conditions.map((condition, index) => (
        <div className="header-row" key={rowKeys[index]}>
          <select
            className="form-input flex-1"
            value={condition.type}
            onChange={(e) => updateRow(index, 'type', e.target.value)}
          >
            {CONDITION_TYPES.map((type) => (
              <option key={type} value={type}>{t(`mocks.modals.manage.form.conditions.type.${type}`)}</option>
            ))}
          </select>
          {condition.type !== 'body' && (
            <input
              className="form-input flex-1"
              placeholder={t('mocks.modals.manage.form.conditions.key.placeholder')}
              value={condition.key}
              onChange={(e) => updateRow(index, 'key', e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          )}
          <select
            className="form-input flex-1"
            value={condition.operator}
            onChange={(e) => updateRow(index, 'operator', e.target.value)}
          >
            {CONDITION_OPERATORS.map((operator) => (
              <option key={operator} value={operator}>{t(`mocks.modals.manage.form.conditions.operator.${operator}`)}</option>
            ))}
          </select>
          {condition.operator !== 'exists' && (
            <input
              className="form-input flex-1-5"
              placeholder={t('mocks.modals.manage.form.conditions.value.placeholder')}
              value={condition.value}
              onChange={(e) => updateRow(index, 'value', e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          )}
          <button
            type="button"
            className="btn btn-outline-danger"
            aria-label={t('mocks.modals.manage.form.conditions.remove')}
            onClick={() => removeRow(index)}
          >
            <i className="bi bi-trash" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addRow}>
        {t('mocks.modals.manage.form.conditions.add')}
      </button>
      <div className="form-hint">{t('mocks.modals.manage.form.conditions.hint')}</div>
    </div>
  );
}
