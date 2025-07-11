
// PopularUsers.tsx
import React, { useState, useEffect } from "react";
import { getPopularUsers, getProfilePicture, getUserInfo } from "../utils/api";
import { Link } from "@remix-run/react";
const PopularUsers: React.FC<{ token: string }> = ({ token }) => {
const [users, setUsers] = useState<any[]>([]);
const [fetchError, setFetchError] = useState<string>("");
const [showAllUsers, setShowAllUsers] = useState(false);
useEffect(() => {
fetchPopularUsers();
 }, [token]);
const fetchPopularUsers = async () => {
try {
const data = await getPopularUsers(token);
const userInfos = await Promise.all(
data.popularUsers.map(async (user: any) => {
const profilePicture = await getProfilePicture(
user.followedId,
token
 );
const userInfo = await getUserInfo(user.followedId, token);
return {
...user,
profilePicture: profilePicture || "/default_profile_pic.png",
...userInfo,
 };
 })
 );
setUsers(userInfos);
 } catch (err) {
setFetchError("Failed to fetch popular users.");
console.error("Error fetching popular users:", err.message);
 }
 };
const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
const target = event.target as HTMLImageElement;
if (target.src !== "/default_profile_pic.png") {
target.src = "/default_profile_pic.png";
 }
 };
const displayedUsers = showAllUsers ? users : users.slice(0, 3);
return (
<div className="popular-users-page flex flex-col items-center justify-center w-full">
{fetchError && <p className="text-red-500 mt-2">{fetchError}</p>}
<div className="w-full max-w-4xl">
{users.length > 0 ? (
<>
<h2 className="text-lg font-bold mb-2 text-gray-200">
 Popular Users
</h2>
{displayedUsers.map((user) => (
<div
key={user.followedId}
className="mb-4 p-4 border border-gray-700 bg-gray-900 rounded-lg flex items-center shadow-md"
>
<Link
to={`/user/${user.followedId}`}
className="flex-grow flex items-center"
>
<img
src={user.profilePicture || "/default_profile_pic.png"}
alt="Profile"
className="w-12 h-12 rounded-full mr-4"
onError={handleImageError}
/>
<div className="text-gray-300">
<p className="font-bold">@{user.username}</p>
<p>{user.name}</p>
<p className="text-gray-500">{user.bio}</p>
</div>
</Link>
</div>
 ))}
{!showAllUsers && users.length > 3 && (
<button
className="p-2 bg-indigo-500 text-white rounded mt-4 hover:bg-indigo-400 transition duration-200"
onClick={() => setShowAllUsers(true)}
>
 Show More Users
</button>
 )}
</>
 ) : (
<p className="text-gray-400">No popular users found.</p>
 )}
</div>
</div>
 );
};
export default PopularUsers;