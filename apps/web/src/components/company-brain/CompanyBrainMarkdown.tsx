import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CompanyBrainMarkdownProps {
  content: string;
}

export function CompanyBrainMarkdown({ content }: CompanyBrainMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-semibold">{children}</h2>,
        h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold">{children}</h3>,
        h4: ({ children }) => <h4 className="mb-2 mt-4 text-sm font-semibold">{children}</h4>,
        p: ({ children }) => <p className="my-3 leading-7 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="my-3 list-disc space-y-1 pl-6 leading-7">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-3 list-decimal space-y-1 pl-6 leading-7">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-2 border-primary/40 pl-4 text-muted-foreground">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            {children}
          </a>
        ),
        code: ({ children, className }) => (
          <code
            className={`${className ?? ''} rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em]`}
          >
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-4 overflow-x-auto rounded-lg border bg-muted/70 p-4 font-mono text-sm leading-6">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
        th: ({ children }) => <th className="border-b px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
        hr: () => <hr className="my-5 border-border" />,
        img: () => null,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
