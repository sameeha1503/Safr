export const resultKey = (place: {
  name: string;
  lat?: number | undefined;
  lng?: number | undefined;
}) => `${place.name}:${place.lat},${place.lng}`;
