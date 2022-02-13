

export default function NavBar() {
    return (
    
      <nav className="navbar navbar-expand-lg navbar-dark">
          <div className="container">
            <a className="navbar-brand" href="#">GP-ARGO</a>
            <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText" aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
              <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarText">
              <span className="navbar-text">
                The Great Plains Augmented Regional Gateway to the Open Science Grid
              </span>
            </div>
          </div>
        </nav>
    )
  }