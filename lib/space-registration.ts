export const spaceInvitationLead = "Join me live on my X page";
export const spaceInvitationDay = "this Sunday";
export const spaceInvitation = `${spaceInvitationLead} ${spaceInvitationDay}`;
export const freeSpaceDescription =
  "Founders discuss their products, users, markets and opportunities. No payment required.";

export const spaceDiscussionOptions = [
  {
    value: "product-and-market",
    label: "Product, market and general opportunities",
  },
  {
    value: "approved-topics",
    label: "The product and any challenges I approve",
  },
] as const;

export const publicSpaceAcknowledgement =
  "I understand that the X Space is public and recorded, and I choose what I share live.";

export function spaceDiscussionLabel(value?: string | null) {
  return (
    spaceDiscussionOptions.find((option) => option.value === value)?.label ??
    "Confirm topics with the founder before the Space."
  );
}
