import { Accordion as Primitive } from '@base-ui/react/accordion';
import { cn } from '@/lib/utils';

function Accordion({ className, ...props }: Primitive.Root.Props) {
  return <Primitive.Root data-slot="accordion" className={cn('accordion', className)} {...props} />;
}
function AccordionItem({ className, ...props }: Primitive.Item.Props) {
  return <Primitive.Item data-slot="accordion-item" className={cn('accordion-item', className)} {...props} />;
}
function AccordionTrigger({ className, children, ...props }: Primitive.Trigger.Props) {
  return <Primitive.Header className="accordion-heading">
    <Primitive.Trigger data-slot="accordion-trigger" className={cn('accordion-trigger', className)} {...props}>
      <span>{children}</span>
      <svg className="accordion-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25">
        <path d="M4 10h12" /><path className="accordion-icon-vertical" d="M10 4v12" />
      </svg>
    </Primitive.Trigger>
  </Primitive.Header>;
}
function AccordionContent({ className, children, ...props }: Primitive.Panel.Props) {
  return <Primitive.Panel data-slot="accordion-content" className={cn('accordion-panel', className)} {...props}>
    <div className="accordion-content">{children}</div>
  </Primitive.Panel>;
}
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
