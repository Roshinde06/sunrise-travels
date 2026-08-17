import { MapPin, AlertTriangle, CheckCircle2, Star } from 'lucide-react';
import { inr, formatDate } from '../utils/format';
import FavoriteButton from './FavoriteButton';
import HotelImage from './HotelImage';

export default function HotelCard({ hotel, policy, checkIn, checkOut, onSelect }) {
  const starsAllowed = policy && hotel.starRating <= policy.maximumHotelStars;
  const rateAllowed = policy && hotel.pricePerNight <= policy.hotelBudgetPerNight;
  const nights = hotel.nights || 1;

  return (
    <div className="card border-0 shadow-sm card-hover overflow-hidden mb-3 anim-fade-in">
      <div className="row g-0">
        {/* Image — full width on mobile, left column on desktop */}
        <div className="col-12 col-md-4 col-lg-3">
          <HotelImage
            hotel={hotel}
            className="hotel-card-img"
            hoverZoom
            alt={`${hotel.name} in ${hotel.city}`}
          />
        </div>

        <div className="col-12 col-md-8 col-lg-9">
          <div className="card-body py-3 h-100 d-flex flex-column">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
              <div>
                <div className="fw-semibold">{hotel.name}</div>
                <div className="small text-muted d-flex align-items-center gap-1">
                  <MapPin size={13} /> {hotel.location || hotel.city}
                </div>
                <div className="small d-flex align-items-center gap-1 mt-1">
                  <span className="text-warning d-inline-flex align-items-center gap-1">
                    <Star size={13} fill="currentColor" /> {hotel.starRating}.0
                  </span>
                  <span className="text-muted ms-1">· {hotel.roomType} room</span>
                </div>
              </div>

              <div className="text-end">
                <div className="small text-muted">{inr(hotel.pricePerNight)}/night</div>
                <div className="fw-bold text-primary fs-5">{inr(hotel.totalPrice || hotel.pricePerNight * nights)} total</div>
                <div className="small text-muted">{nights} night{nights === 1 ? '' : 's'} · Free cancellation</div>
              </div>
            </div>

            <div className="mt-2 flex-grow-1">
              {(hotel.amenities || []).slice(0, 5).map((a) => (
                <span key={a} className="badge text-bg-light border me-1 mb-1">{a}</span>
              ))}
            </div>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2">
              <div>
                {policy && !starsAllowed && (
                  <div className="small text-danger d-flex align-items-center gap-1">
                    <AlertTriangle size={13} /> Exceeds {policy.maximumHotelStars}-star limit
                  </div>
                )}
                {policy && starsAllowed && !rateAllowed && (
                  <div className="small text-warning">Exceeds hotel budget/night</div>
                )}
                {policy && starsAllowed && rateAllowed && (
                  <div className="small text-success d-flex align-items-center gap-1">
                    <CheckCircle2 size={13} /> Policy compliant
                  </div>
                )}
                {checkIn && (
                  <div className="small text-muted mt-1">{formatDate(checkIn)} → {formatDate(checkOut)}</div>
                )}
              </div>
              <div className="d-flex align-items-center gap-2">
                <FavoriteButton
                  type="hotel"
                  id={hotel._id}
                  title={hotel.name}
                  subtitle={`${hotel.city} · ${'★'.repeat(hotel.starRating)} · ${hotel.roomType}`}
                  price={hotel.totalPrice || hotel.pricePerNight * nights}
                />
                <button className="btn btn-sm btn-primary btn-lift" onClick={() => onSelect(hotel)}>
                  Select Hotel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
