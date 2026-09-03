import logoAgosoft from "./images/logo_agosoft.png";
import backgroundImage from "./images/background_image.png";

function srcOf(asset) {
  if (!asset) return "";
  return typeof asset === "string" ? asset : asset.src;
}

export const APP_LOGO_SRC = srcOf(logoAgosoft);
export const APP_BACKGROUND_SRC = srcOf(backgroundImage);
