import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/format';
import TicketView from '../../components/TicketView';

export default function TicketPage() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get(`/bookings/${id}/ticket`);
        setData(res.data);
      } catch (err) {
        setError(getErrorMessage(err, 'Ticket not found.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (error || !data?.booking) {
    return (
      <div className="text-center py-5">
        <h5 className="fw-bold mb-3">Ticket unavailable</h5>
        <p className="text-muted mb-4">{error || 'This booking has no final ticket yet.'}</p>
        <Link to="/employee/my-trips" className="btn btn-primary">Back to My Trips</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }} className="mx-auto">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to="/employee/my-trips" className="small text-decoration-none text-secondary d-inline-flex align-items-center gap-1">
          <ArrowLeft size={14} /> Back to My Trips
        </Link>
        <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => window.print()}>
          <Download size={15} /> Print / Save
        </button>
      </div>

      <TicketView booking={data.booking} travelRequest={data.travelRequest} />

      <div className="text-center mt-4">
        <Link to="/employee/my-trips" className="btn btn-primary">View all my trips</Link>
      </div>
    </div>
  );
}
