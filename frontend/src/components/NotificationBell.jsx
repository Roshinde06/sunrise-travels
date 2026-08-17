import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { formatDateTime } from '../utils/format';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await client.get('/notifications');
      setItems(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      clearInterval(timer);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await client.patch('/notifications/read-all');
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const openLink = (n) => {
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="position-relative" ref={ref}>
      <button className="btn btn-link position-relative text-white p-1" onClick={handleOpen} title="Notifications">
        <Bell size={20} />
        {unread > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger" style={{ fontSize: '0.6rem' }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg border" style={{ width: 360, maxHeight: 420, overflowY: 'auto', zIndex: 1050 }}>
          <div className="px-3 py-2 border-bottom fw-semibold text-dark">Notifications</div>
          {items.length === 0 && <div className="p-3 text-muted small">No notifications yet.</div>}
          {items.map((n) => (
            <button
              key={n._id}
              className={`d-block w-100 text-start px-3 py-2 border-0 border-bottom bg-transparent ${n.read ? '' : 'bg-primary-subtle'}`}
              onClick={() => openLink(n)}
            >
              <div className="d-flex justify-content-between gap-2">
                <span className="fw-semibold small">{n.title}</span>
                <span className="text-muted small text-nowrap">{formatDateTime(n.createdAt)}</span>
              </div>
              <div className="text-secondary small">{n.message}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
