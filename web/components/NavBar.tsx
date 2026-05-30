import Link from "next/link";

export default function NavBar() {
  return (
    <header className="bg-black text-white py-4 sticky top-0">
      <nav className="max-w-5xl flex justify-between items-center mx-auto">
        <div className="flex gap-4 items-center">
          <Link href="/" className="text-lg font-bold">
            Mentor Portal
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/about" className="navlink">
              About
            </Link>
            <Link href="/about" className="navlink">
              Mentorship
            </Link>
            <Link href="/about" className="navlink">
              Resources
            </Link>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            href="/login"
            className="border border-white rounded-lg px-4 py-1"
          >
            Login
          </Link>
          <Link
            href="/about"
            className="bg-white text-black px-4 py-1 rounded-lg"
          >
            Apply Now
          </Link>
        </div>
      </nav>
    </header>
  );
}
