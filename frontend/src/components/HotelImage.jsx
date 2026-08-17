import { useState } from 'react';
import { hotelPosterUrl } from '../utils/travelImages';

/**
 * Hotel image that ALWAYS renders.
 * - Primary: the external photo URL from the hotel document (if provided)
 * - Fallback (onError or no URL): a locally generated SVG poster
 *   (gradient + city skyline + hotel name), so images show even offline.
 * - Meaningful alt text, lazy loading, object-fit handled by callers.
 */
export default function HotelImage({ hotel, className = '', style, alt, hoverZoom = false }) {
  const [failed, setFailed] = useState(false);
  const name = hotel?.name || 'Hotel';
  const city = hotel?.city || '';
  const altText = alt || `${name} in ${city}`.trim();

  const src = failed || !hotel?.image ? hotelPosterUrl(hotel) : hotel.image;
  const isPoster = failed || !hotel?.image;

  const img = (
    <img
      src={src}
      alt={isPoster ? `${name} (image placeholder)` : altText}
      loading="lazy"
      draggable={false}
      className={className}
      style={style}
      onError={() => {
        // External photo failed → swap to the local poster (renders as an img,
        // so hover-zoom and sizing behave identically).
        if (!isPoster) setFailed(true);
      }}
    />
  );

  return hoverZoom ? <div className="img-hover-zoom h-100 w-100">{img}</div> : img;
}
