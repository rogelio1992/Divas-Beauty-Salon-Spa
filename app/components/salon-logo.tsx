import Image from "next/image";
import logo from "../../public/images/logo-divas.png";

export default function SalonLogo() {
    return <Image src={logo} alt="Divas Beauty Spa" className="salon-logo" sizes="(max-width: 680px) 96px, 128px" priority/>;
}
