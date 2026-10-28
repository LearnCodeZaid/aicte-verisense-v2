import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="We could not find that page"
      description="The link may be out of date or the address mistyped. Return to the portal home to continue."
      action={
        <Button asChild size="sm">
          <Link to="/portal">Back to portal home</Link>
        </Button>
      }
    />
  );
}
