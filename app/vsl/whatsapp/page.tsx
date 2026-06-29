import type { Metadata } from "next";
import FeatureDetail, { featureMetadata } from "../_detalle/FeatureDetail";

export const metadata: Metadata = featureMetadata("whatsapp");

export default function Page() {
  return <FeatureDetail slug="whatsapp" />;
}
