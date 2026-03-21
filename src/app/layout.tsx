export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#2e063b]"> 
        {/* Set a dark base color to prevent a white flash on load */}
        {children}
      </body>
    </html>
  );
}