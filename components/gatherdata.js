import useSWR from 'swr'


const fetcher = (url) => fetch(url).then((res) => res.json());

export function GetProjects() {
    const { data, error } = useSWR('/api/projects', fetcher, { refreshInterval: 3600000 });
    return { data, error };

}


export function GetCoreHoursRate() {
    const { data, error } = useSWR('/api/corehoursrate', fetcher, { refreshInterval: 3600000 });
    return { data, error };
}
