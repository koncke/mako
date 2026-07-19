import type { Metadata } from "next";
import FeatureDetail, { featureMetadata } from "../_detalle/FeatureDetail";

export const metadata: Metadata = featureMetadata("fase-norte");

export default function Page() {
  return <FeatureDetail slug="fase-norte" />;
}
