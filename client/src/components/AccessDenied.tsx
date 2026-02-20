import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full p-6" data-testid="access-denied">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view this page. Contact an administrator to request access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
