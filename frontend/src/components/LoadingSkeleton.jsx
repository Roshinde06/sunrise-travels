/**
 * Shimmer skeletons — shown while search/load is in progress instead of a
 * blank screen or plain spinner. Pure CSS (transform/opacity only).
 */
export default function LoadingSkeleton({ variant = 'flight', count = 3 }) {
  if (variant === 'hotel') {
    return (
      <div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card border-0 shadow-sm mb-3 overflow-hidden">
            <div className="row g-0">
              <div className="col-12 col-md-4 col-lg-3">
                <div className="skeleton" style={{ height: 180 }} />
              </div>
              <div className="col-12 col-md-8 col-lg-9 p-3">
                <div className="skeleton skeleton-line" style={{ width: '45%', height: 16 }} />
                <div className="skeleton skeleton-line" style={{ width: '30%' }} />
                <div className="skeleton skeleton-line" style={{ width: '70%' }} />
                <div className="skeleton skeleton-line" style={{ width: '55%' }} />
                <div className="skeleton" style={{ width: 120, height: 32, marginTop: 10 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // flight variant (also used as generic row skeleton)
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card border-0 shadow-sm mb-3 overflow-hidden">
          <div className="card-body d-flex flex-wrap align-items-center gap-3">
            <div className="skeleton" style={{ width: 46, height: 40 }} />
            <div className="flex-grow-1" style={{ minWidth: 200 }}>
              <div className="skeleton skeleton-line" style={{ width: '35%', height: 14 }} />
              <div className="skeleton skeleton-line" style={{ width: '60%' }} />
              <div className="skeleton skeleton-line" style={{ width: '45%' }} />
            </div>
            <div className="text-end" style={{ width: 120 }}>
              <div className="skeleton skeleton-line" style={{ width: '60%', marginLeft: 'auto' }} />
              <div className="skeleton" style={{ width: 90, height: 32, marginLeft: 'auto' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
