export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border py-6 text-center text-sm text-muted">
      <div className="mx-auto max-w-5xl px-4">
        &copy; {new Date().getFullYear()} Wishlist
      </div>
    </footer>
  );
}
