import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaLibraryBrowser } from "@/components/MediaLibraryBrowser";
import { Image as ImageIcon } from "lucide-react";

export default function MediaLibraryPage() {
  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-media-library">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            Every image uploaded across the platform — organized by game and category. Click an image to copy its URL.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Images</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaLibraryBrowser defaultOpen={false} />
        </CardContent>
      </Card>
    </div>
  );
}
