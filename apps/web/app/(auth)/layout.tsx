export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900">KinderBase</h1>
          <p className="text-sm text-gray-500 mt-1">Childcare management platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
