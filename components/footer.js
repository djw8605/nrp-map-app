export default function Footer() {
  return (
    <section className="footer">
      <div className="container mx-auto">
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-4">
          <div className="col-md-12 flex align-items-center items-center">
            <img
              src="/images/nsf-logo.png" // Replace with the actual path to the NSF logo
              alt="NSF Logo"
              className="h-12 mr-3"
            />
            <span className="text-sm text-gray-200">
              This work was supported in part by National Science Foundation (NSF) awards CNS-1730158, ACI-1540112, ACI-1541349, OAC-1826967, OAC-2112167, CNS-2100237, CNS-2120019.
            </span>
          </div>
        </footer>
      </div>
    </section>
  );
}