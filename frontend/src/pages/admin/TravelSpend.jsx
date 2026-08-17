import { useEffect, useState } from 'react';
import { Wallet, CalendarRange, MapPin, Plane } from 'lucide-react';
import client from '../../api/client';
import { inr } from '../../utils/format';

export default function TravelSpend() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await client.get('/admin/travel-spend');
      setData(res.data);
    })();
  }, []);

  if (!data) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;

  const maxMonth = Math.max(...data.byMonth.map((m) => m.total), 1);
  const maxCity = Math.max(...data.byCity.map((c) => c.total), 1);
  const maxClass = Math.max(...data.byClass.map((c) => c.total), 1);

  return (
    <div>
      <h4 className="fw-bold mb-3">Travel Spend</h4>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="stat-card p-3 bg-white d-flex align-items-center gap-3">
            <div className="rounded-3 p-2 bg-success-subtle text-success"><Wallet size={20} /></div>
            <div>
              <div className="text-muted text-uppercase small">Total spend (ticketed)</div>
              <div className="fw-bold fs-4">{inr(data.total)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card p-3 bg-white d-flex align-items-center gap-3">
            <div className="rounded-3 p-2 bg-primary-subtle text-primary"><CalendarRange size={20} /></div>
            <div>
              <div className="text-muted text-uppercase small">Ticketed bookings</div>
              <div className="fw-bold fs-4">{data.totalBookings}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card p-3 bg-white d-flex align-items-center gap-3">
            <div className="rounded-3 p-2 bg-info-subtle text-info"><MapPin size={20} /></div>
            <div>
              <div className="text-muted text-uppercase small">Top destination</div>
              <div className="fw-bold fs-4">{data.byCity[0]?._id || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* By month */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold">Spend by Month</div>
            <div className="card-body">
              {data.byMonth.length === 0 && <div className="text-muted small">No ticketed bookings yet.</div>}
              <div className="bar-chart mb-2">
                {data.byMonth.map((m) => (
                  <div key={m._id} className="flex-grow-1 d-flex flex-column justify-content-end" title={`${m._id}: ${inr(m.total)}`}>
                    <div className="bar w-100" style={{ height: `${Math.max((m.total / maxMonth) * 140, 4)}px` }} />
                  </div>
                ))}
              </div>
              <div className="d-flex justify-content-between text-muted small">
                {data.byMonth.map((m) => (
                  <span key={m._id}>{m._id}</span>
                ))}
              </div>
              <div className="table-responsive mt-3">
                <table className="table table-sm">
                  <thead className="table-light">
                    <tr><th>Month</th><th className="text-end">Bookings</th><th className="text-end">Spend</th></tr>
                  </thead>
                  <tbody>
                    {data.byMonth.map((m) => (
                      <tr key={m._id}>
                        <td>{m._id}</td>
                        <td className="text-end">{m.count}</td>
                        <td className="text-end fw-semibold">{inr(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* By city */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold">Spend by Destination City</div>
            <div className="card-body">
              <div className="d-flex flex-column gap-2">
                {data.byCity.map((c) => (
                  <div key={c._id}>
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold d-inline-flex align-items-center gap-1"><MapPin size={13} /> {c._id}</span>
                      <span>{inr(c.total)} · {c.count} booking(s)</span>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                      <div className="progress-bar bg-primary" style={{ width: `${(c.total / maxCity) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {data.byCity.length === 0 && <div className="text-muted small">No data yet.</div>}
              </div>
            </div>
          </div>
        </div>

        {/* By class */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">Spend by Travel Class</div>
            <div className="card-body">
              <div className="d-flex flex-column gap-2">
                {data.byClass.map((c) => (
                  <div key={c._id}>
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold d-inline-flex align-items-center gap-1"><Plane size={13} /> {c._id}</span>
                      <span>{inr(c.total)} · {c.count} booking(s)</span>
                    </div>
                    <div className="progress" style={{ height: 8 }}>
                      <div className="progress-bar bg-success" style={{ width: `${(c.total / maxClass) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {data.byClass.length === 0 && <div className="text-muted small">No data yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
