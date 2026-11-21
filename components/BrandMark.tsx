export default function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      fill="none"
    >
      <path d="M12 5h23L21 19H8L2 25 12 5Z" fill="currentColor" opacity=".9" />
      <path
        d="M28 35H5l14-14h13l6-6-10 20Z"
        fill="currentColor"
        opacity=".55"
      />
      <path
        d="m9 17 10-9h9L18 17H9Zm22 6-10 9h-9l10-9h9Z"
        fill="#fff"
        opacity=".8"
      />
    </svg>
  );
}
