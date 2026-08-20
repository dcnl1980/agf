import { ReactNode } from 'react';
import { cn } from "../../lib/utils";

interface SectionWrapperProps {
  id?: string;
  children: ReactNode;
  altTheme?: boolean;
  className?: string;
  containerClassName?: string;
}

export function SectionWrapper({ 
  id, 
  children, 
  altTheme = false, 
  className,
  containerClassName,
}: SectionWrapperProps) {
  return (
    <section 
      id={id} 
      className={cn(
        "section group",
        altTheme ? "section-alt" : "",
        className
      )}
      data-theme={altTheme ? 'light' : 'dark'}
    >
      <div className={cn("container-page", containerClassName)}>
        {children}
      </div>
    </section>
  );
}
