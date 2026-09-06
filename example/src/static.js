// Deliberately does not import utilities.css. Only the generated fallback is loaded,
// so every browser renders the same rules an old browser would get.
import "./style.css";
import "./tokens.css";
import "./generated/static-only.css";
import { renderDemo } from "./demo.js";

renderDemo("#demo");
