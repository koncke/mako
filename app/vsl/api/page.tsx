import type { Metadata } from "next";
import FeatureDetail, { featureMetadata } from "../_detalle/FeatureDetail";

export const metadata: Metadata = featureMetadata("api");

export default function Page() {
  return <FeatureDetail slug="api" />;
}
