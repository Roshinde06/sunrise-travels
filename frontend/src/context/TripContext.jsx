import { createContext, useContext, useState } from 'react';

const TripContext = createContext(null);
const STORAGE_KEY = 'sunrise_trip_draft';

function loadDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function TripProvider({ children }) {
  const [trip, setTrip] = useState(loadDraft);

  const updateTrip = (patch) => {
    setTrip((prev) => {
      const next = { ...(prev || {}), ...patch };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearTrip = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setTrip(null);
  };

  return (
    <TripContext.Provider value={{ trip, updateTrip, clearTrip }}>{children}</TripContext.Provider>
  );
}

export const useTrip = () => useContext(TripContext);
