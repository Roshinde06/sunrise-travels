import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const FavoritesContext = createContext(null);
const KEY = 'sunrise_favorites';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const keyOf = useCallback((type, id) => `${type}:${id}`, []);

  const has = useCallback((type, id) => items.some((i) => i.key === keyOf(type, id)), [items, keyOf]);

  const toggle = useCallback(
    (item) => {
      const key = item.key || keyOf(item.type, item.id);
      setItems((prev) => (prev.some((i) => i.key === key) ? prev.filter((i) => i.key !== key) : [{ ...item, key }, ...prev]));
    },
    [keyOf]
  );

  const remove = useCallback((key) => setItems((prev) => prev.filter((i) => i.key !== key)), []);

  return (
    <FavoritesContext.Provider value={{ items, has, toggle, remove }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
