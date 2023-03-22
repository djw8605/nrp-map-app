

export default function NavBar() {
  return (
    <>
      <nav className="px-2 sm:px-4 py-5 bg-background-blue">
        <div className="container mx-auto">
          <div className="container flex flex-wrap justify-between items-center mx-auto">
            <a href="/" className="flex items-center">
              <span className="self-center text-xl font-semibold whitespace-nowrap text-white">NRP</span>
            </a>
          </div>
        </div>
      </nav>
    </>
  )
}