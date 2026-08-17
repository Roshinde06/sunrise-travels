import { useEffect, useRef, useState } from 'react';
import { Heart, Plane, Hotel, X, Star } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { inr } from '../utils/format';

export default function FavoritesMenu() {
  const { items, remove } = useFavorites();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="position-relative" ref={ref}>
      <button className="btn btn-link position-relative text-white p-1" onClick={() => setOpen((o) => !o)} title="Favorites">
        <Heart size={20} fill={items.length ? 'currentColor' : 'none'} />
        {items.length > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-warning" style={{ fontSize: '0.6rem' }}>
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border" style={{ width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 1050 }}>
          <div className="px-3 py-2 border-bottom fw-semibold text-dark d-flex align-items-center gap-2">
            <Star size={15} className="text-warning" /> Saved trips & stays
          </div>
          {items.length === 0 && (
            <div className="p-3 text-muted small">
              No favorites yet. Tap the <Heart size={13} className="text-danger d-inline" fill="currentColor" /> on any flight or hotel to save it here.
            </div>
          )}
          {items.map((item) => (
            <div key={item.key} className="d-flex align-items-center gap-2 px-3 py-2 border-bottom">
              {item.type === 'flight' ? (
                <Plane size={16} className="text-primary flex-shrink-0" />
              ) : (
                <Hotel size={16} className="text-primary flex-shrink-0" />
              )}
              <div className="flex-grow-1 min-w-0">
                <div className="small fw-semibold text-truncate">{item.title}</div>
                <div className="small text-muted text-truncate">{item.subtitle}</div>
              </div>
              {typeof item.price === 'number' && <div className="small fw-semibold text-nowrap">{inr(item.price)}</div>}
              <button className="btn btn-sm p-0 border-0" onClick={() => remove(item.key)} title="Remove">
                <X size={14} className="text-secondary" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
