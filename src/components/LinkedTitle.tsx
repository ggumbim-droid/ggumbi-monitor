interface LinkedTitleProps {
  title: string;
  link?: string | null;
  className?: string;
  linkClassName?: string;
}

const DEFAULT_TITLE_CLASS =
  "mt-1 block font-semibold text-stone-800 line-clamp-2";

export function LinkedTitle({
  title,
  link,
  className = DEFAULT_TITLE_CLASS,
  linkClassName = "cursor-pointer text-stone-800 hover:text-kkumbi-600 hover:underline",
}: LinkedTitleProps) {
  const href = link?.trim();

  if (!href) {
    return <h3 className={className}>{title}</h3>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} ${linkClassName}`}
    >
      {title}
    </a>
  );
}
