import {
  SECTORS,
  FUNCTIONS,
  STAGES,
  NEEDS,
  RELATIONS,
  OPPORTUNITY_TYPES,
} from "@/lib/catalog";
import type { DataState } from "@/lib/types";
export function taxonomyDefaults(): DataState["labels"] {
  const labels: DataState["labels"] = [];
  for (const [group, values] of Object.entries({
    Sector: SECTORS,
    "Economic function": FUNCTIONS,
    "Customer segment": [
      "Small businesses",
      "Web3 teams",
      "Consumers",
      "Developers",
    ],
    "Business model": [
      "Subscription",
      "Usage based",
      "Transaction fee",
      "Services",
    ],
    "Product stage": STAGES,
    "Geographic market": ["Africa", "Global", "Nigeria", "East Africa"],
    "Blockchain ecosystem": ["Solana", "Ethereum", "Base", "Multichain"],
    "Business needs": NEEDS,
    "Company relationship": RELATIONS,
    "Opportunity type": OPPORTUNITY_TYPES,
  }))
    values.forEach((name, i) =>
      labels.push({ id: `label-${group}-${i}`, group, name, active: true }),
    );
  return labels;
}
