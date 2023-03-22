import { useSelector, useDispatch } from 'react-redux'
import { update } from '../redux/updateTime'

export default function Footer() {
  const time = useSelector((state) => state.updateTime.value);
  var dateString = new Date(time).toLocaleDateString("en-US");
  var timeString = new Date(time).toLocaleTimeString("en-US");

  return (
    <section className="footer">
      <div className="container mx-auto">
        <footer className="d-flex flex-wrap justify-content-between align-items-center py-3">
          <div className="col-md-12 align-items-center">

            <span>National Research Platform</span>
            <span className="float-right">Last Updated at: { dateString + " " + timeString}</span>
          </div>
          {/*
        <ul class="nav col-md-4 justify-content-end list-unstyled d-flex">
          <li class="ms-3"><a class="text-muted" href="#"><svg class="bi" width="24" height="24"><use xlink:href="#twitter" /></svg></a></li>
          <li class="ms-3"><a class="text-muted" href="#"><svg class="bi" width="24" height="24"><use xlink:href="#instagram" /></svg></a></li>
          <li class="ms-3"><a class="text-muted" href="#"><svg class="bi" width="24" height="24"><use xlink:href="#facebook" /></svg></a></li>
        </ul>
        */}
        </footer>
      </div>
    </section>
  )
}