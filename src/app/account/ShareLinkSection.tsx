import ShareLinkButton from "@/app/my-list/ShareLinkButton";

export default function ShareLinkSection({ existingToken }: { existingToken: string | null }) {
  return <>
    <h2 className="text-lg font-semibold">Public Share Link</h2>
    <p className="mt-1 text-sm text-muted">Share your wishlist with friends. They can claim gifts without an account or email address.</p>
    <ShareLinkButton existingToken={existingToken} />
  </>;
}
