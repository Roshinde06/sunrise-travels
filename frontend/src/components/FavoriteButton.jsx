import { Heart } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';

export default function FavoriteButton({ type, id, title, subtitle, price }) {
  const { has, toggle } = useFavorites();
  const active = has(type, id);

  return (
    <button
      type="button"
      className="btn btn-sm border-0 p-1"
      title={active ? 'Remove from favorites' : 'Save to favorites'}
      onClick={() => toggle({ type, id, title, subtitle, price })}
      style={{ background: 'transparent' }}
    >
      <Heart size={17} className={active ? 'text-danger' : 'text-secondary'} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
