import { createFileRoute } from "@tanstack/react-router";
import { FieldStudio } from "@/components/field-studio";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FieldStudio />;
}
