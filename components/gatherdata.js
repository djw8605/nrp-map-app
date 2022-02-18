import useSWR from 'swr'
import { useDispatch } from 'react-redux'
import { update } from '../redux/updateTime'


const fetcher = (url) => fetch(url).then((res) => res.json());

export function GetProjects() {
    const { data, error } = useSWR('/api/projects', fetcher, { refreshInterval: 3600000 });
    const dispatch = useDispatch()
    if (data) {
        dispatch(update(data.updateTime));
    }
    return { data, error };

}


export function GetCoreHoursRate() {
    const { data, error } = useSWR('/api/corehoursrate', fetcher, { refreshInterval: 3600000 });
    return { data, error };
}
