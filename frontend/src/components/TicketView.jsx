import { Plane, Hotel, Ticket as TicketIcon, CalendarDays, MapPin } from 'lucide-react';
import { inr, formatDate, time12 } from '../utils/format';
import TravelProgress from './TravelProgress';

export default function TicketView({ booking, travelRequest }) {
  if (!booking) return null;
  const passenger = travelRequest ? travelRequest.employeeName : '—';
  const designation = travelRequest ? travelRequest.employeeDesignation : '';

  const travelType = travelRequest?.travelType || (booking.hotelName ? (booking.airline ? 'flight_hotel' : 'hotel') : 'flight');
  const hasFlight = travelType !== 'hotel' && (booking.airline || booking.flightNumber);
  const hasHotel = travelType !== 'flight' && (booking.hotelName);

  const checkIn = booking.hotelCheckIn || travelRequest?.travelDate;
  const checkOut = booking.hotelCheckOut || travelRequest?.returnDate;

  return (
    <div className="ticket">
      {/* Header */}
      <div className="bg-brand-gradient text-white px-4 py-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <TicketIcon size={22} />
          <div>
            <div className="fw-bold">CORPORATE TRAVEL TICKET</div>
            <div className="small opacity-75">Project Sunrise · Corporate Travel Booking Platform</div>
          </div>
        </div>
        <div className="text-end">
          <div className="fw-semibold">{booking.pnr}</div>
          <div className="small opacity-75">PNR / Ticket No</div>
        </div>
      </div>

      <div className="p-4">
        {/* Journey progress — completed here because a final ticket exists */}
        <div className="mb-4">
          <TravelProgress
            steps={['Request', 'Manager Approval', 'Admin Booking', 'Final Ticket']}
            current={4}
          />
        </div>

        {/* Passenger */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="text-muted small text-uppercase">Passenger</div>
            <div className="fw-semibold">{passenger}</div>
            {designation && <div className="small text-secondary">{designation}</div>}
          </div>
          <div className="col-md-4">
            <div className="text-muted small text-uppercase">Booking ID</div>
            <div className="fw-semibold">{booking.bookingReference}</div>
          </div>
          <div className="col-md-4">
            <div className="text-muted small text-uppercase">Status</div>
            <span className="badge text-bg-success">TICKETED</span>
            {booking.seat && <div className="small text-secondary mt-1">Seat: <span className="fw-semibold">{booking.seat}</span></div>}
          </div>
        </div>

        <hr />

        {/* Flight */}
        {hasFlight && (
          <>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Plane size={18} className="text-primary" />
                <span className="fw-semibold">Flight — {booking.airline} {booking.flightNumber}</span>
                <span className="badge text-bg-light border">{booking.travelClass}</span>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-3">
                <div>
                  <div className="fw-bold fs-5">{booking.flightFrom}</div>
                  <div className="small text-muted">{time12(booking.flightDepartureTime)}</div>
                </div>
                <div className="flex-grow-1 border-top border-2 border-dashed mx-2" style={{ borderStyle: 'dashed' }} />
                <div className="text-center text-muted small">
                  <CalendarDays size={14} className="mx-auto mb-1" />
                  {formatDate(booking.flightDate)}
                </div>
                <div className="flex-grow-1 border-top border-2 border-dashed mx-2" style={{ borderStyle: 'dashed' }} />
                <div className="text-end">
                  <div className="fw-bold fs-5">{booking.flightTo}</div>
                  <div className="small text-muted">{time12(booking.flightArrivalTime)}</div>
                </div>
              </div>
            </div>
            <hr />
          </>
        )}

        {/* Hotel */}
        {hasHotel && (
          <>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Hotel size={18} className="text-primary" />
                <span className="fw-semibold">Hotel — {booking.hotelName}</span>
                <span className="badge text-bg-light border">{'★'.repeat(booking.hotelStarRating || 0)}</span>
              </div>
              <div className="d-flex align-items-center gap-2 text-secondary">
                <MapPin size={14} />
                <span>
                  {booking.hotelCity} · {booking.hotelRoomType} room
                </span>
              </div>
              <div className="small text-secondary mt-1">
                Check-in {formatDate(checkIn)} → Check-out {formatDate(checkOut)}
              </div>
            </div>
            <hr />
          </>
        )}

        <div className="d-flex justify-content-between align-items-center">
          <div className="text-muted small">
            Issued {booking.ticketedAt ? new Date(booking.ticketedAt).toLocaleString('en-IN') : '—'}
            {travelRequest && travelRequest.requestId ? ` · Request ${travelRequest.requestId}` : ''}
          </div>
          <div className="text-end">
            <div className="text-muted small text-uppercase">Total Amount</div>
            <div className="fw-bold fs-4 text-primary">{inr(booking.totalAmount)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
