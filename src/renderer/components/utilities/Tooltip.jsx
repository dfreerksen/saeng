import { useRef, useEffect, cloneElement } from 'react';
import { Tooltip as BsTooltip } from 'bootstrap';

export default function Tooltip({ title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !title) return;
    const tip = new BsTooltip(el, { title, trigger: 'hover focus' });
    // Clicking a button focuses it, which (via the 'focus' trigger) keeps the
    // tooltip open. Blur instead of tip.hide() here: hide() forces Bootstrap's
    // internal trigger state closed without going through its own focusout
    // handling, so the native focusin from this same click immediately
    // schedules a fresh show() and the tooltip flashes back in. Blurring lets
    // Bootstrap's own _leave()/_isWithActiveTrigger() bookkeeping decide.
    const blur = () => el.blur();
    el.addEventListener('click', blur);
    return () => {
      el.removeEventListener('click', blur);
      // dispose() alone already removes the tip element and detaches all
      // listeners regardless of shown state. Calling hide() first is not
      // just redundant: hide() queues a callback to run after the CSS fade
      // transition ends, and dispose() nulls out every instance property
      // (including _activeTrigger) synchronously right after. When that
      // queued callback later fires on the now-disposed instance, it throws
      // trying to read _activeTrigger — reproducible by unmounting a
      // tooltip-wrapped element faster than the ~150ms fade (e.g. rapidly
      // toggling the About modal).
      tip.dispose();
    };
  }, [title]);

  return cloneElement(children, { ref });
}
