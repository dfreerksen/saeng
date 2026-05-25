import { useRef, useEffect, cloneElement } from 'react';
import { Tooltip as BsTooltip } from 'bootstrap';

export default function Tooltip({ title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !title) return;
    const tip = new BsTooltip(el, { title, trigger: 'hover focus' });
    const hide = () => tip.hide();
    el.addEventListener('click', hide);
    return () => {
      el.removeEventListener('click', hide);
      tip.hide();
      tip.dispose();
    };
  }, [title]);

  return cloneElement(children, { ref });
}
