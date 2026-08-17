import { useEffect, useState } from 'react';
import { BarChart3, PieChart, TrendingUp, Users } from 'lucide-react';
import client from '../../api/client';
import { inr, STATUS_META } from '../../utils/format';

const STATUS_COLORS = {
  PENDING: 'bg-warning',
  APPROVED: 'bg-primary',
  READY_FOR_TICKETING: 'bg-info',
  TICKETED: 'bg-success',
  REJECTED: 'bg-danger',
  CANCELLED: 'bg-dark',
  DRAFT: 'bg-secondary',
};

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await client.get('/admin/analytics');
      setData(res.data);
    })();
  }, []);

  if (!data) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  const totalStatus = data.byStatus.reduce((sum, s) => sum + s.count, 0) || 1;
  const maxDay = Math.max(...data.perDay.map((d) => d.count), 1);
  const maxCity = Math.max(...data.byCity.map((c) => c.count), 1);
  const maxDesig = Math.max(...data.byDesignation.map((d) => d.total), 1);

  return (
    <div>
      <h4 className="fw-bold mb-3">Travel Analytics</h4>

      <div className="row g-4">
        {/* Status distribution */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <PieChart size={16} className="text-primary" /> Requests by Status
            </div>
            <div className="card-body">
              {data.byStatus.map((s) => (
                <div key={s._id} className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="fw-semibold">{STATUS_META[s._id]?.label || s._id}</span>
                    <span>{s.count} · {Math.round((s.count / totalStatus) * 100)}%</span>
                  </div>
                  <div className="progress" style={{ height: 10 }}>
                    <div className={`progress-bar ${STATUS_COLORS[s._id] || 'bg-secondary'}`} style={{ width: `${(s.count / totalStatus) * 100}%` }} />
                  </div>
                </div>
              ))}
              {data.byStatus.length === 0 && <div className="text-muted small">No data yet.</div>}
            </div>
          </div>
        </div>

        {/* Per-day bookings */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <BarChart3 size={16} className="text-primary" /> Requests per Day (last 14 days)
            </div>
            <div className="card-body">
              {data.perDay.length === 0 && <div className="text-muted small">No requests in the last 14 days.</div>}
              <div className="bar-chart mb-2">
                {data.perDay.map((d) => (
                  <div key={d._id} className="flex-grow-1 d-flex flex-column justify-content-end" title={`${d._id}: ${d.count}`}>
                    <div className="bar w-100" style={{ height: `${Math.max((d.count / maxDay) * 140, 4)}px` }} />
                  </div>
                ))}
              </div>
              <div className="d-flex justify-content-between text-muted small">
                {data.perDay.map((d) => (
                  <span key={d._id}>{d._id.slice(5)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top cities */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> Most Travelled Cities
            </div>
            <div className="card-body">
              {data.byCity.map((c) => (
                <div key={c._id} className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="fw-semibold">{c._id}</span>
                    <span>{c.count} request(s)</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className="progress-bar bg-info" style={{ width: `${(c.count / maxCity) * 100}%` }} />
                  </div>
                </div>
              ))}
              {data.byCity.length === 0 && <div className="text-muted small">No data yet.</div>}
            </div>
          </div>
        </div>

        {/* Spend by designation */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
              <Users size={16} className="text-primary" /> Travel Spend by Designation
            </div>
            <div className="card-body">
              {data.byDesignation.map((d) => (
                <div key={d._id || 'unknown'} className="mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="fw-semibold">{d._id || 'Unassigned'}</span>
                    <span>{inr(d.total)} · {d.count} booking(s)</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className="progress-bar bg-success" style={{ width: `${(d.total / maxDesig) * 100}%` }} />
                  </div>
                </div>
              ))}
              {data.byDesignation.length === 0 && <div className="text-muted small">No ticketed bookings yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
