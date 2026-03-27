import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPanelProps = {
  title: string;
  description: string;
  body: string;
};

/** Consistent empty-state card for MVP placeholder pages. */
export function PlaceholderPanel({ title, description, body }: PlaceholderPanelProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );
}
