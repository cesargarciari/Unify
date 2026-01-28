import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <p className="text-xs tracking-widest text-muted-foreground">ERROR 404</p>
        <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
            
            <div className="place-items-center mt-2">
                <Image src="/404.gif" alt="Not Found" width={300} height={300} className="rounded-2xl"/>
            </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild className="bg-primary text-primary-foreground hover:opacity-90">
            <Link href="/events">Go to Events</Link>
          </Button>
          <Button variant="outline" className="border-border" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
