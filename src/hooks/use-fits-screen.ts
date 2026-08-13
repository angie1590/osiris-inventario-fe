import { useEffect, useState } from "react";

const QUERY = "(min-height: 800px)";

/** Alto suficiente para fijar el formulario a la pantalla y scrollear solo la tabla. */
export function useFitsScreen() {
  const [fits, setFits] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = () => setFits(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return fits;
}
