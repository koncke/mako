import type { Metadata } from "next";
import FeatureDetail, { featureMetadata } from "../_detalle/FeatureDetail";

export const metadata: Metadata = featureMetadata("closing");

export default function Page() {
  return <FeatureDetail slug="closing" />;
}
