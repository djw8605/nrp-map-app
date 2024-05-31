import useSWR from 'swr'
import { update } from '../redux/updateTime'


const fetcher = (url) => fetch(url).then((res) => res.json());

export function GetProjects() {
    const { data, error } = useSWR('/api/projects', fetcher, { refreshInterval: 3600000 });
    const dispatch = useDispatch()
    return { data, error };

}


export function GetCoreHoursRate() {
    const { data, error } = useSWR('/api/corehoursrate', fetcher, { refreshInterval: 3600000 });
    return { data, error };
}

export function GetNamespaces() {
    const { data, error } = useSWR('/api/namespaceInfo', fetcher, { refreshInterval: 3600000 });
    return { data, error };
}

export function GetNamespaceUsage() {
    const { data, error } = useSWR('/api/namespaceUsage', fetcher, { refreshInterval: 3600000 });
    return { data, error };
}
